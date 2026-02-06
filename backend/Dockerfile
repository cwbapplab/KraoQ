FROM node:18-slim

# Install system dependencies for Python and ffmpeg
# yt-dlp needs ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Symlink python3 to python (to match 'python-shell' expectations in backend/server.js if needed, or we configure it)
# The backend code sets pythonPath: 'py' or 'python' likely. On linux 'python3'.
# Let's verify server.js sets 'pythonPath' to 'py' which is windows specific or simple. 
# We should probably update server.js to use 'python3' or just alias it.
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN ln -s /usr/bin/python3 /usr/bin/py

WORKDIR /app

# Copy package.json and install Node deps
COPY package.json ./
RUN npm install --production

# Copy requirements.txt and install Python deps
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy backend source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Command to run the app
CMD ["node", "server.js"]
