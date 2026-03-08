# Use a lightweight Node base image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Only copy package manifests and install dependencies first (leverages caching)
COPY package*.json ./

# Install dependencies (npm ci requires a package-lock.json which may not exist yet)
# Using npm install ensures Docker build succeeds even without a lock file.
RUN npm install --production

# Copy remaining source
COPY . .

# Build the Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
