@echo off
echo Starting Hardhat node...
start "Hardhat Node" cmd /k "npx hardhat node"

echo Deploying contracts (optional)...
REM To deploy contracts, uncomment the next line
start "Deploy Contracts" cmd /k "npx hardhat run scripts/deploy.js --network localhost"

echo Starting frontend application...
cd frontend
start "Frontend" cmd /k "npm start"

echo All components initiated. 