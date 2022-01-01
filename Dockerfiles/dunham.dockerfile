FROM docker.io/kwyn/puppeteer:latest

COPY . /home/pptruser/workspace

WORKDIR /home/pptruser/workspace

USER pptruser

# Skip dev dependency of puppeteer since it's baked into the image.
RUN npm install --production

CMD ["node", "index.js"]