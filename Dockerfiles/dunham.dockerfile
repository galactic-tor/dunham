FROM node:16.13.1-slim

FROM docker.io/kwyn/puppeteer:latest

USER root

COPY . /home/pptruser/workspace

WORKDIR /home/pptruser/workspace

RUN  chown -R pptruser:pptruser /home/pptruser/workspace 
# Skip dev dependency of puppeteer since it's baked into the image.
USER pptruser

RUN npm install --production

CMD ["node", "index.js"]