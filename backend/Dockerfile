FROM node:20-slim

WORKDIR /app

# The dependencies are now built natively on the host machine to bypass Windows Docker Desktop bugs.
# We simply copy the pre-built application folder (including node_modules).
COPY . .

EXPOSE 5000
CMD ["npm", "start"]
