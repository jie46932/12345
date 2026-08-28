$ErrorActionPreference = 'Stop'
$hostName = if ($env:DEPLOY_HOST) { $env:DEPLOY_HOST } else { throw 'DEPLOY_HOST is required' }
$user = if ($env:DEPLOY_USER) { $env:DEPLOY_USER } else { 'root' }
$port = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } else { '22' }
$argsList = @('-p',$port); if ($env:DEPLOY_IDENTITY) { $argsList += @('-i',$env:DEPLOY_IDENTITY) }
ssh @argsList "$user@$hostName" "/srv/scripts/verify-web3d-site.sh 12345 https://hefurniture.gsdmsj.cn 12345-auth-api"
if ($LASTEXITCODE) { throw 'server verification failed' }
