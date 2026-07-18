# Author: Klaasvaakie ( |╲ )
[CmdletBinding()]
param(
    [switch]$BuildImage
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "encore"
$imageName = "kasihub-encore-cli:1.57.11"
$dindName = "kasihub-encore-dind"
$devName = "kasihub-encore-dev"
$dockerDataVolume = "kasihub-encore-docker-data"
$encoreConfigVolume = "kasihub-encore-config"

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running."
}

$imageExists = docker image inspect $imageName 2>$null
if ($BuildImage -or $LASTEXITCODE -ne 0) {
    docker build --build-arg ENCORE_VERSION=1.57.11 -f (Join-Path $backendPath "Dockerfile.cli") -t $imageName $backendPath
    if ($LASTEXITCODE -ne 0) { throw "Encore CLI image build failed." }
}

$dindExists = docker container inspect $dindName 2>$null
if ($LASTEXITCODE -ne 0) {
    docker volume create $dockerDataVolume *> $null
    docker run -d --name $dindName --privileged --restart unless-stopped `
        -p 4001:4001 -p 9401:9400 `
        -v "${dockerDataVolume}:/var/lib/docker" `
        docker:29-dind --host=tcp://0.0.0.0:2375 --tls=false *> $null
} else {
    docker start $dindName *> $null
}

$deadline = (Get-Date).AddSeconds(45)
do {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker exec $dindName docker info 2>$null | Out-Null
    $dockerInfoExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    if ($dockerInfoExitCode -eq 0) { break }
    Start-Sleep -Milliseconds 750
} while ((Get-Date) -lt $deadline)
if ($dockerInfoExitCode -ne 0) { throw "Encore database engine did not become ready." }

docker rm -f $devName 2>$null *> $null
docker volume create $encoreConfigVolume *> $null

$runArgs = @(
    "run", "-d", "--name", $devName,
    "--restart", "unless-stopped",
    "--network", "container:$dindName",
    "--entrypoint", "bash",
    "-e", "DOCKER_HOST=tcp://127.0.0.1:2375",
    "-v", "${backendPath}:/app",
    "-v", "${encoreConfigVolume}:/root/.config/encore"
)

$authToken = Join-Path $env:APPDATA "encore\.auth_token"
if (Test-Path -LiteralPath $authToken) {
    $runArgs += @("-v", "${authToken}:/tmp/auth_token:ro")
}

$startup = "mkdir -p /root/.config/encore; if [ -s /tmp/auth_token ] && [ ! -s /root/.config/encore/.auth_token ]; then cp /tmp/auth_token /root/.config/encore/.auth_token; fi; exec encore run --listen 0.0.0.0:4001 --browser never --color=false"
$runArgs += @($imageName, "-lc", $startup)
docker @runArgs *> $null
if ($LASTEXITCODE -ne 0) { throw "Encore backend container failed to start." }

$healthDeadline = (Get-Date).AddSeconds(90)
do {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:4001/health" -TimeoutSec 2
        if ($health.ok -eq $true) { break }
    } catch {}
    Start-Sleep -Seconds 1
} while ((Get-Date) -lt $healthDeadline)

if ($health.ok -ne $true) {
    docker logs --tail 100 $devName
    throw "Encore did not pass its health check."
}

Write-Output "Encore API: http://127.0.0.1:4001"
Write-Output "Encore dashboard: http://127.0.0.1:9401"
