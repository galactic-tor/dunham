ARG ARCH=
FROM ${ARCH}node:16.13.1-slim

FROM docker.io/kwyn/puppeteer:latest

USER pptruser

COPY . /home/pptruser/workspace

WORKDIR /home/pptruser/workspace
# Skip dev dependency of puppeteer since it's baked into the image.
RUN npm install --production

CMD ["node", "index.js"]