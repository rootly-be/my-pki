#!/usr/bin/env bash
set -euo pipefail

########################################
# Script de création d'une CA personnalisée
########################################

usage() {
  cat <<EOF
Usage: $0 [options]
Options :
  -d DIR     Répertoire racine de la PKI (défaut : \$HOME/my-pki/ca)
  -n NAME    Common Name (CN) de la CA (défaut : "rootly network")
  -i ID      Identifiant unique de la CA (défaut : "default")
  -o ORG     Organization (O) de la CA (défaut : "rootly")
  -u OU      Organizational Unit (OU) de la CA (défaut : "IT")
  -p PASS    Mot de passe pour chiffrer la clé privée (obligatoire)
  -v DAYS    Durée de vie en jours du certificat racine (défaut : 3650)
  -h         Affiche cette aide
EOF
  exit 1
}

# Valeurs par défaut
CA_DIR="${HOME}/my-pki/ca"
ROOT_CN="rootly network"
CA_ID="default"
ROOT_O="rootly"
ROOT_OU="IT"
PASS=""
DAYS_ROOT=3650

# Parse options
while getopts "d:n:i:o:u:p:v:h" opt; do
  case "$opt" in
    d) CA_DIR="$OPTARG"            ;;
    n) ROOT_CN="$OPTARG"           ;;
    i) CA_ID="$OPTARG"             ;;
    o) ROOT_O="$OPTARG"            ;;
    u) ROOT_OU="$OPTARG"           ;;
    p) PASS="$OPTARG"              ;;
    v) DAYS_ROOT="$OPTARG"         ;;
    h) usage                       ;;
    *) usage                      ;;
  esac
done
shift $((OPTIND-1))

# Vérification
if [[ -z "$PASS" ]]; then
  echo "❌ Vous devez fournir un mot de passe (-p)." >&2
  usage
fi

# Création des dossiers avec support multi-CA
CA_SUBDIR="${CA_DIR}/${CA_ID}"
mkdir -p "${CA_SUBDIR}"
chmod 700 "${CA_SUBDIR}"

echo "👉 Génération de la CA ${CA_ID} dans ${CA_SUBDIR}"
echo "   CN=${ROOT_CN}, O=${ROOT_O}, OU=${ROOT_OU}, validité=${DAYS_ROOT}j"

# 1. Clé privée chiffrée AES‑256
openssl genrsa -aes256 \
  -passout pass:"${PASS}" \
  -out "${CA_SUBDIR}/${CA_ID}_ca.key" 4096

# 2. Certificat auto‑signé
openssl req -x509 -new -nodes \
  -key "${CA_SUBDIR}/${CA_ID}_ca.key" \
  -passin pass:"${PASS}" \
  -sha256 -days "${DAYS_ROOT}" \
  -subj "/CN=${ROOT_CN}/O=${ROOT_O}/OU=${ROOT_OU}" \
  -out "${CA_SUBDIR}/${CA_ID}_ca.crt"

# 3. Sécurisation des permissions
chmod 600 "${CA_SUBDIR}/${CA_ID}_ca.key"
chmod 644 "${CA_SUBDIR}/${CA_ID}_ca.crt"

# 4. Créer des liens symboliques pour compatibilité avec l'ancien système
if [[ "$CA_ID" == "default" ]]; then
  # Create hard copies instead of symlinks for better compatibility
  cp "${CA_SUBDIR}/${CA_ID}_ca.key" "${CA_DIR}/root_ca.key" 2>/dev/null || true
  cp "${CA_SUBDIR}/${CA_ID}_ca.crt" "${CA_DIR}/root_ca.crt" 2>/dev/null || true
  # Initialize serial file if it doesn't exist
  if [[ ! -f "${CA_DIR}/root_ca.srl" && -f "${CA_SUBDIR}/${CA_ID}_ca.srl" ]]; then
    cp "${CA_SUBDIR}/${CA_ID}_ca.srl" "${CA_DIR}/root_ca.srl" 2>/dev/null || true
  elif [[ ! -f "${CA_DIR}/root_ca.srl" ]]; then
    echo "01" > "${CA_DIR}/root_ca.srl"
  fi
fi

echo "✅ CA ${CA_ID} générée avec succès !"
echo "   Clé privée : ${CA_SUBDIR}/${CA_ID}_ca.key"
echo "   Certificat : ${CA_SUBDIR}/${CA_ID}_ca.crt"

