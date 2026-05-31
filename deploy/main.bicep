// Process Hub — Azure VM deployment
// Deploys: VM (Ubuntu), NSG, NIC, public IP, storage for data volume
// App Registration must be created manually in Entra ID first — see README.

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('VM size')
param vmSize string = 'Standard_B2s'

@description('Admin username for the VM')
param adminUsername string = 'processhub'

@description('SSH public key for VM access')
param adminSshKey string

@description('DNS label prefix — must be globally unique')
param dnsLabelPrefix string

@description('App name for white-labelling')
param appName string = 'Process Hub'

@description('Primary brand colour (hex)')
param primaryColor string = '#0078d4'

@description('Entra App Registration client ID')
param entraClientId string

@description('Entra tenant ID')
param entraTenantId string

var vmName = 'processhub-vm'
var nicName = 'processhub-nic'
var nsgName = 'processhub-nsg'
var ipName = 'processhub-ip'
var diskName = 'processhub-disk'

resource publicIp 'Microsoft.Network/publicIPAddresses@2023-04-01' = {
  name: ipName
  location: location
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: { domainNameLabel: dnsLabelPrefix }
  }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-04-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowSSH'
        properties: {
          priority: 120
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: 'processhub-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/24'] }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.0.0.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  name: nicName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: { id: publicIp.id }
          subnet: { id: vnet.properties.subnets[0].id }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2023-07-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: { vmSize: vmSize }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        name: diskName
        createOption: 'FromImage'
        diskSizeGB: 64
        managedDisk: { storageAccountType: 'Premium_LRS' }
      }
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: adminSshKey
            }
          ]
        }
      }
      // Cloud-init script — installs Node 20, clones app, sets env vars, starts PM2
      customData: base64('''
#cloud-config
package_update: true
packages:
  - nginx
  - certbot
  - python3-certbot-nginx
  - git
runcmd:
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs
  - npm install -g pm2
  - mkdir -p /opt/processhub
  - chown ${adminUsername}:${adminUsername} /opt/processhub
''')
    }
    networkProfile: {
      networkInterfaces: [{ id: nic.id }]
    }
  }
}

output fqdn string = publicIp.properties.dnsSettings.fqdn
output publicIp string = publicIp.properties.ipAddress
output vmName string = vmName
output entraRedirectUri string = 'https://${publicIp.properties.dnsSettings.fqdn}'
// After deploy, add this redirect URI to the Entra App Registration
// and set the env vars on the VM:
//   ENTRA_CLIENT_ID = ${entraClientId}
//   ENTRA_TENANT_ID = ${entraTenantId}
//   VITE_APP_NAME   = ${appName}
//   VITE_PRIMARY_COLOR = ${primaryColor}
