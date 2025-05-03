FROM node:20

WORKDIR /usr/src/app

COPY package.json package-lock.json /usr/src/app/
COPY tsconfig.json /usr/src/app/

RUN npm install

COPY . /usr/src/app
COPY tsconfig.json /usr/src/app/tsconfig.json

RUN npx prisma generate

RUN npm run build

CMD ["npm", "run", "start:prod"]