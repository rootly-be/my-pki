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
  -n NAME    Common Name (CN) de la CA (défaut : "MaCA Homelab")
  -o ORG     Organization (O) de la CA (défaut : "Rootly")
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
ROOT_O="rootly"
ROOT_OU="IT"
PASS=""
DAYS_ROOT=3650

# Parse options
while getopts "d:n:o:u:p:v:h" opt; do
  case "$opt" in
    d) CA_DIR="$OPTARG"            ;;
    n) ROOT_CN="$OPTARG"           ;;
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

# Création des dossiers
mkdir -p "${CA_DIR}"
chmod 700 "${CA_DIR}"

echo "👉 Génération de la CA dans ${CA_DIR}"
echo "   CN=${ROOT_CN}, O=${ROOT_O}, OU=${ROOT_OU}, validité=${DAYS_ROOT}j"

# 1. Clé privée chiffrée AES‑256
openssl genrsa -aes256 \
  -passout pass:"${PASS}" \
  -out "${CA_DIR}/root_ca.key" 4096

# 2. Certificat auto‑signé
openssl req -x509 -new -nodes \
  -key "${CA_DIR}/root_ca.key" \
  -passin pass:"${PASS}" \
  -sha256 -days "${DAYS_ROOT}" \
  -subj "/CN=${ROOT_CN}/O=${ROOT_O}/OU=${ROOT_OU}" \
  -out "${CA_DIR}/root_ca.crt"

# 3. Sécurisation des permissions
chmod 600 "${CA_DIR}/root_ca.key"
chmod 644 "${CA_DIR}/root_ca.crt"

echo "✅ CA générée avec succès !"
echo "   Clé privée : ${CA_DIR}/root_ca.key"
echo "   Certificat : ${CA_DIR}/root_ca.crt"

