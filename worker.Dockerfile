FROM node:22-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the project if needed (though we use tsx for the worker)
RUN npm install -g tsx

CMD ["tsx", "scripts/worker.ts"]
