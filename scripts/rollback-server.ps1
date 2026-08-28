param([Parameter(Mandatory)][string]$ReleaseId)
$ErrorActionPreference = 'Stop'; if (!$env:DEPLOY_HOST) { throw 'DEPLOY_HOST is required' }
$user = if ($env:DEPLOY_USER) { $env:DEPLOY_USER } else { 'root' }; $port = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } else { '22' }
$a=@('-p',$port); if($env:DEPLOY_IDENTITY){$a+=@('-i',$env:DEPLOY_IDENTITY)}
ssh @a "$user@$env:DEPLOY_HOST" "VERIFY_BASE_URL='https://hefurniture.gsdmsj.cn' /srv/scripts/rollback-release.sh 12345 '$ReleaseId'"
if($LASTEXITCODE){throw 'rollback failed'}
