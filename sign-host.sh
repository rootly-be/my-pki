#!/usr/bin/env bash
set -euo pipefail

#############################################
# sign-host.sh — Génère et signe un certificat
#############################################

usage() {
  cat <<EOF
Usage: $0 -n HOSTNAME -p PASS [options]
Options :
  -n HOSTNAME   Nom d'hôte à signer (ex. homepage.mgmt.rootly.local)
  -p PASS       Mot de passe de la clé CA (obligatoire)
  -i CA_ID      Identifiant de la CA à utiliser (défaut : "default")
  -d CA_DIR     Répertoire racine de la CA (défaut : \$HOME/my-pki/ca)
  -c OUT_DIR    Répertoire de sortie des certificats (défaut : \$HOME/my-pki/certs)
  -v DAYS       Durée de validité du certificat (défaut : 825 jours)
  -h            Affiche cette aide
EOF
  exit 1
}

# valeurs par défaut
CA_DIR="${HOME}/my-pki/ca"
OUT_DIR="${HOME}/my-pki/certs"
CA_ID="default"
DAYS_CERT=825

# parse args
HOSTNAME=""
PASS=""
while getopts "n:p:i:d:c:v:h" opt; do
  case "$opt" in
    n) HOSTNAME="$OPTARG" ;;
    p) PASS="$OPTARG"      ;;
    i) CA_ID="$OPTARG"     ;;
    d) CA_DIR="$OPTARG"    ;;
    c) OUT_DIR="$OPTARG"   ;;
    v) DAYS_CERT="$OPTARG" ;;
    h) usage               ;;
    *) usage               ;;
  esac
done
shift $((OPTIND-1))

# vérifications
if [[ -z "$HOSTNAME" || -z "$PASS" ]]; then
  echo "❌ Il faut au moins un hostname (-n) et le mot de passe CA (-p)." >&2
  usage
fi

# chemins avec support multi-CA
CA_SUBDIR="${CA_DIR}/${CA_ID}"
CA_KEY="${CA_SUBDIR}/${CA_ID}_ca.key"
CA_CERT="${CA_SUBDIR}/${CA_ID}_ca.crt"
SERIAL_FILE="${CA_SUBDIR}/${CA_ID}_ca.srl"

# fallback pour compatibilité avec l'ancien système
if [[ "$CA_ID" == "default" && ! -f "$CA_KEY" ]]; then
  CA_KEY="${CA_DIR}/root_ca.key"
  CA_CERT="${CA_DIR}/root_ca.crt"
  SERIAL_FILE="${CA_DIR}/root_ca.srl"
fi

# check CA files
if [[ ! -f "$CA_KEY" || ! -f "$CA_CERT" ]]; then
  echo "❌ Impossible de trouver la CA '${CA_ID}' dans ${CA_SUBDIR} ou ${CA_DIR}." >&2
  echo "   Vérifiez que la CA existe ou créez-la avec create-ca.sh -i ${CA_ID}" >&2
  exit 1
fi

# préparer le dossier de sortie
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

# noms de fichiers
KEY_FILE="${OUT_DIR}/${HOSTNAME}.key"
CSR_FILE="${OUT_DIR}/${HOSTNAME}.csr"
CRT_FILE="${OUT_DIR}/${HOSTNAME}.crt"
FULLCHAIN="${OUT_DIR}/${HOSTNAME}_fullchain.crt"
EXTFILE="$(mktemp)"

echo "👉 Génération pour ${HOSTNAME} avec CA '${CA_ID}'"
echo "   Clé : $KEY_FILE"
echo "   Certificat : $CRT_FILE"
echo "   Fullchain : $FULLCHAIN"

# 1. générer la clé privée
openssl genrsa -out "$KEY_FILE" 4096

# 2. générer la CSR
openssl req -new \
  -key "$KEY_FILE" \
  -subj "/CN=${HOSTNAME}" \
  -out "$CSR_FILE"

# 3. créer extfile pour SAN
cat > "$EXTFILE" <<EOF
subjectAltName = DNS:${HOSTNAME}
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
EOF

# 4. signer la CSR
openssl x509 -req \
  -in "$CSR_FILE" \
  -CA "$CA_CERT" \
  -CAkey "$CA_KEY" \
  -passin pass:"$PASS" \
  -CAcreateserial \
  -out "$CRT_FILE" \
  -days "$DAYS_CERT" \
  -sha256 \
  -extfile "$EXTFILE"

# 5. construire la fullchain (leaf + root)
cat "$CRT_FILE" "$CA_CERT" > "$FULLCHAIN"

# 6. permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CRT_FILE" "$FULLCHAIN"

# nettoyage
rm -f "$EXTFILE" "$CSR_FILE"

echo "✅ Fini pour ${HOSTNAME}."
echo "   -> Clé privée : $KEY_FILE"
echo "   -> Certificat : $CRT_FILE"
echo "   -> Fullchain  : $FULLCHAIN"

