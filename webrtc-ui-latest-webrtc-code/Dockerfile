# Use an official Node.js runtime as the base image
FROM node:21-alpine3.18

# Set the working directory inside the container
WORKDIR /webrtc-ui

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port on which your server will listen
EXPOSE 9000

# Start the Node.js server
CMD [ "npm", "start" ]