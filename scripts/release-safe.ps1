$ErrorActionPreference = 'Stop'
& 'F:\company-knowledge-base\scripts\safe-release.ps1' -ProjectRoot (Split-Path -Parent $PSScriptRoot) -ProjectId '12345' -BaseUrl 'https://hefurniture.gsdmsj.cn' @args
