# ConnectHub Docker Build Script
# This script builds and starts the entire ConnectHub stack in Docker.

Write-Host "`n=== ConnectHub Docker Build ===" -ForegroundColor Cyan

# Step 1: Build frontend on host (npm works reliably here)
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend npm install failed!" -ForegroundColor Red; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed!" -ForegroundColor Red; exit 1 }
Write-Host "Frontend built successfully!" -ForegroundColor Green

# Step 2: Build backend locally
Write-Host "`n[2/4] Building backend dependencies..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\backend"
npm install --omit=dev
if ($LASTEXITCODE -ne 0) { Write-Host "Backend npm install failed!" -ForegroundColor Red; exit 1 }
Write-Host "Backend dependencies installed successfully!" -ForegroundColor Green

# Step 3: Build backend Docker image
Write-Host "`n[3/4] Building Docker images..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot"
docker compose build
if ($LASTEXITCODE -ne 0) { Write-Host "Docker compose build failed!" -ForegroundColor Red; exit 1 }
Write-Host "Docker images built successfully!" -ForegroundColor Green

# Step 4: Start everything
Write-Host "`n[4/4] Starting all containers..." -ForegroundColor Yellow
$env:DOCKER_BUILDKIT = "1"
docker-compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "Docker Compose failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== ConnectHub is running! ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000/health" -ForegroundColor Cyan
Write-Host ""
