#!/usr/bin/env bash
set -euo pipefail

#############################################
# manage-ca.sh — Gestionnaire multi-CA
#############################################

usage() {
  cat <<EOF
Usage: $0 COMMAND [options]

COMMANDS:
  list                          Liste toutes les CA disponibles
  create -i ID -p PASS [opts]   Crée une nouvelle CA
  sign -i ID -n HOST -p PASS    Signe un certificat avec une CA
  info -i ID                    Affiche les infos d'une CA
  verify -i ID -f CERT          Vérifie un certificat avec une CA

OPTIONS GLOBALES:
  -d CA_DIR     Répertoire racine des CA (défaut : \$HOME/my-pki/ca)
  -h            Affiche cette aide

OPTIONS CREATE:
  -i ID         Identifiant unique de la CA (obligatoire)
  -n NAME       Common Name de la CA
  -o ORG        Organization de la CA
  -u OU         Organizational Unit de la CA
  -p PASS       Mot de passe pour la clé privée (obligatoire)
  -v DAYS       Durée de vie en jours (défaut : 3650)

OPTIONS SIGN:
  -i ID         Identifiant de la CA à utiliser (obligatoire)
  -n HOST       Nom d'hôte à signer (obligatoire)
  -p PASS       Mot de passe de la CA (obligatoire)
  -c OUT_DIR    Répertoire de sortie (défaut : \$HOME/my-pki/certs)
  -v DAYS       Durée de validité (défaut : 825)

EXEMPLES:
  $0 list
  $0 create -i prod -p mypass -n "Production CA" -o "MyOrg"
  $0 sign -i prod -n www.example.com -p mypass
  $0 info -i prod
  $0 verify -i prod -f /path/to/cert.crt
EOF
  exit 1
}

# Valeurs par défaut
CA_DIR="${HOME}/my-pki/ca"
COMMAND=""

# Parse command
if [[ $# -eq 0 ]]; then
  usage
fi
COMMAND="$1"
shift

case "$COMMAND" in
  list|create|sign|info|verify)
    # valid commands
    ;;
  *)
    echo "❌ Commande inconnue : $COMMAND" >&2
    usage
    ;;
esac

# Parse options globales
while getopts "d:h" opt; do
  case "$opt" in
    d) CA_DIR="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

#############################################
# Fonctions utilitaires
#############################################

list_cas() {
  echo "📋 CA disponibles dans ${CA_DIR}:"
  if [[ ! -d "$CA_DIR" ]]; then
    echo "   Aucune CA trouvée (répertoire inexistant)"
    return
  fi
  
  local found=false
  for ca_subdir in "${CA_DIR}"/*; do
    if [[ -d "$ca_subdir" ]]; then
      local ca_id=$(basename "$ca_subdir")
      local ca_cert="${ca_subdir}/${ca_id}_ca.crt"
      local ca_key="${ca_subdir}/${ca_id}_ca.key"
      
      if [[ -f "$ca_cert" && -f "$ca_key" ]]; then
        echo "   ✅ ${ca_id}"
        # Afficher des infos sur le certificat
        local subject=$(openssl x509 -in "$ca_cert" -noout -subject 2>/dev/null | sed 's/subject=//')
        local not_after=$(openssl x509 -in "$ca_cert" -noout -enddate 2>/dev/null | sed 's/notAfter=//')
        echo "      Subject: $subject"
        echo "      Expires: $not_after"
        found=true
      fi
    fi
  done
  
  # Vérifier aussi l'ancien format pour la compatibilité
  if [[ -f "${CA_DIR}/root_ca.crt" && -f "${CA_DIR}/root_ca.key" ]]; then
    echo "   ✅ default (format legacy)"
    local subject=$(openssl x509 -in "${CA_DIR}/root_ca.crt" -noout -subject 2>/dev/null | sed 's/subject=//')
    local not_after=$(openssl x509 -in "${CA_DIR}/root_ca.crt" -noout -enddate 2>/dev/null | sed 's/notAfter=//')
    echo "      Subject: $subject"
    echo "      Expires: $not_after"
    found=true
  fi
  
  if [[ "$found" == "false" ]]; then
    echo "   Aucune CA trouvée"
  fi
}

show_ca_info() {
  local ca_id="$1"
  local ca_subdir="${CA_DIR}/${ca_id}"
  local ca_cert="${ca_subdir}/${ca_id}_ca.crt"
  
  # Fallback pour le format legacy
  if [[ "$ca_id" == "default" && ! -f "$ca_cert" ]]; then
    ca_cert="${CA_DIR}/root_ca.crt"
  fi
  
  if [[ ! -f "$ca_cert" ]]; then
    echo "❌ CA '${ca_id}' introuvable" >&2
    exit 1
  fi
  
  echo "📋 Informations CA '${ca_id}':"
  echo "   Certificat: $ca_cert"
  echo
  openssl x509 -in "$ca_cert" -text -noout
}

verify_cert() {
  local ca_id="$1"
  local cert_file="$2"
  local ca_subdir="${CA_DIR}/${ca_id}"
  local ca_cert="${ca_subdir}/${ca_id}_ca.crt"
  
  # Fallback pour le format legacy
  if [[ "$ca_id" == "default" && ! -f "$ca_cert" ]]; then
    ca_cert="${CA_DIR}/root_ca.crt"
  fi
  
  if [[ ! -f "$ca_cert" ]]; then
    echo "❌ CA '${ca_id}' introuvable" >&2
    exit 1
  fi
  
  if [[ ! -f "$cert_file" ]]; then
    echo "❌ Certificat '${cert_file}' introuvable" >&2
    exit 1
  fi
  
  echo "🔍 Vérification du certificat avec la CA '${ca_id}'..."
  if openssl verify -CAfile "$ca_cert" "$cert_file"; then
    echo "✅ Certificat valide"
  else
    echo "❌ Certificat invalide"
    exit 1
  fi
}

#############################################
# Exécution des commandes
#############################################

case "$COMMAND" in
  list)
    list_cas
    ;;
    
  create)
    # Reset OPTIND pour le parsing des options de create
    OPTIND=1
    CA_ID=""
    ROOT_CN="rootly network"
    ROOT_O="rootly"
    ROOT_OU="IT"
    PASS=""
    DAYS_ROOT=3650
    
    while getopts "i:n:o:u:p:v:h" opt; do
      case "$opt" in
        i) CA_ID="$OPTARG" ;;
        n) ROOT_CN="$OPTARG" ;;
        o) ROOT_O="$OPTARG" ;;
        u) ROOT_OU="$OPTARG" ;;
        p) PASS="$OPTARG" ;;
        v) DAYS_ROOT="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
      esac
    done
    
    if [[ -z "$CA_ID" || -z "$PASS" ]]; then
      echo "❌ Il faut au moins un ID (-i) et un mot de passe (-p)" >&2
      usage
    fi
    
    # Appeler le script create-ca.sh
    exec "$(dirname "$0")/create-ca.sh" -d "$CA_DIR" -i "$CA_ID" -n "$ROOT_CN" -o "$ROOT_O" -u "$ROOT_OU" -p "$PASS" -v "$DAYS_ROOT"
    ;;
    
  sign)
    # Reset OPTIND pour le parsing des options de sign
    OPTIND=1
    CA_ID=""
    HOSTNAME=""
    PASS=""
    OUT_DIR="${HOME}/my-pki/certs"
    DAYS_CERT=825
    
    while getopts "i:n:p:c:v:h" opt; do
      case "$opt" in
        i) CA_ID="$OPTARG" ;;
        n) HOSTNAME="$OPTARG" ;;
        p) PASS="$OPTARG" ;;
        c) OUT_DIR="$OPTARG" ;;
        v) DAYS_CERT="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
      esac
    done
    
    if [[ -z "$CA_ID" || -z "$HOSTNAME" || -z "$PASS" ]]; then
      echo "❌ Il faut au moins un ID CA (-i), un hostname (-n) et un mot de passe (-p)" >&2
      usage
    fi
    
    # Appeler le script sign-host.sh
    exec "$(dirname "$0")/sign-host.sh" -d "$CA_DIR" -i "$CA_ID" -n "$HOSTNAME" -p "$PASS" -c "$OUT_DIR" -v "$DAYS_CERT"
    ;;
    
  info)
    # Reset OPTIND pour le parsing des options de info
    OPTIND=1
    CA_ID=""
    
    while getopts "i:h" opt; do
      case "$opt" in
        i) CA_ID="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
      esac
    done
    
    if [[ -z "$CA_ID" ]]; then
      echo "❌ Il faut spécifier un ID de CA (-i)" >&2
      usage
    fi
    
    show_ca_info "$CA_ID"
    ;;
    
  verify)
    # Reset OPTIND pour le parsing des options de verify
    OPTIND=1
    CA_ID=""
    CERT_FILE=""
    
    while getopts "i:f:h" opt; do
      case "$opt" in
        i) CA_ID="$OPTARG" ;;
        f) CERT_FILE="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
      esac
    done
    
    if [[ -z "$CA_ID" || -z "$CERT_FILE" ]]; then
      echo "❌ Il faut spécifier un ID de CA (-i) et un fichier certificat (-f)" >&2
      usage
    fi
    
    verify_cert "$CA_ID" "$CERT_FILE"
    ;;
esac