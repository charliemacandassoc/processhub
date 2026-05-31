#!/usr/bin/env bash
# Process Hub — one-shot Azure deployment
# Usage: ./deploy.sh <resource-group> <dns-label> <ssh-pub-key-file> <entra-client-id> <entra-tenant-id>
# Requires: az CLI logged in, with Owner or Contributor on the subscription

set -euo pipefail

RG="${1:?Resource group name required}"
DNS="${2:?DNS label required (globally unique)}"
SSH_KEY_FILE="${3:?Path to SSH public key file required}"
CLIENT_ID="${4:?Entra App Registration client ID required}"
TENANT_ID="${5:?Entra tenant ID required}"

SSH_KEY=$(cat "$SSH_KEY_FILE")

echo "Creating resource group $RG..."
az group create --name "$RG" --location australiaeast

echo "Deploying Bicep template..."
az deployment group create \
  --resource-group "$RG" \
  --template-file "$(dirname "$0")/main.bicep" \
  --parameters \
    dnsLabelPrefix="$DNS" \
    adminSshKey="$SSH_KEY" \
    entraClientId="$CLIENT_ID" \
    entraTenantId="$TENANT_ID" \
  --query "properties.outputs" \
  --output table

echo ""
echo "Deployment complete."
echo "Next steps:"
echo "  1. SSH to the VM: ssh processhub@${DNS}.<region>.cloudapp.azure.com"
echo "  2. Clone the repo to /opt/processhub"
echo "  3. Copy .env.example to .env and fill in values"
echo "  4. Run: npm install && npm run build && pm2 start backend/dist/index.js --name processhub"
echo "  5. Configure nginx reverse proxy (port 3001 → 443)"
echo "  6. Run: sudo certbot --nginx -d ${DNS}.<region>.cloudapp.azure.com"
echo "  7. Add the FQDN as a redirect URI in the Entra App Registration"
