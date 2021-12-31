FROM docker.io/kwyn/puppeteer:latest

COPY . /workspace

WORKDIR /workspace

USER pptruser

# Skip dev dependency of puppeteer since it's baked into the image.
RUN npm install --production

CMD ["node", "index.js"]