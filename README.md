# ultimate-tictactoe-online

Веб-игра "Ultimate Tic-Tac-Toe" с онлайн-режимом 1v1.

## Структура проекта

```text
frontend/  клиентское приложение
server/    backend API, WebSocket и работа с базой данных
```

## Стек

### Frontend

- React для интерфейса.
- Vite для dev-сервера и production-сборки.
- CSS без UI-фреймворка.
- Fetch API для HTTP-запросов к backend.
- JWT хранится в `localStorage` и используется для восстановления сессии.

### Backend

- NestJS для HTTP API и модульной структуры backend.
- Socket.IO через NestJS WebSocket Gateway для онлайн-матчей.
- Prisma ORM для работы с базой данных.
- PostgreSQL как основная база данных.
- Redis используется для матчмейкинга.
- JWT авторизация через Passport strategy.
- Class Validator / Class Transformer для валидации DTO.
- Jest для тестов.

## Текущий функционал

### Авторизация

- Регистрация пользователя по логину, email и паролю.
- Вход по логину и паролю.
- Получение текущего пользователя через `/auth/me`.
- Хранение access token на клиенте.
- Восстановление сессии после перезагрузки страницы.
- Выход из аккаунта на клиенте.

### Матчмейкинг

- Добавление авторизованного пользователя в очередь быстрой игры.
- Удаление пользователя из очереди.
- Backend-слой матчмейкинга подготовлен для онлайн-режима.

### Матчи и игра

- Backend содержит игровую логику Ultimate Tic-Tac-Toe.
- Backend поддерживает создание ходов в матче.
- WebSocket namespace `/matches` поддерживает подключение к матчу и отправку ходов.
- Frontend пока содержит только auth-экран; лобби, игровое поле и WebSocket UI еще не реализованы.

## Требования

- Node.js 20+.
- npm.
- PostgreSQL.
- Redis.

## Установка зависимостей

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd server
npm install
```

## Запуск в режиме разработки

1. Запустить PostgreSQL и Redis.

2. Подготовить переменные окружения backend.

   В каталоге `server` нужен `.env` с настройками подключения к базе, Redis и JWT. Конкретные значения зависят от локального окружения.

3. Применить Prisma-миграции.

```bash
cd server
npx prisma migrate dev
```

4. Запустить backend.

```bash
cd server
npm run start:dev
```

Backend по умолчанию слушает `http://localhost:3000`.

5. Запустить frontend.

```bash
cd frontend
npm run dev
```

Vite dev-сервер запустит клиентское приложение и будет проксировать API-запросы `/auth`, `/matchmaking` и `/matches` на `http://localhost:3000`.

## Production-сборка

1. Собрать frontend.

```bash
cd frontend
npm run build
```

2. Собрать backend.

```bash
cd server
npm run build
```

3. Запустить backend.

```bash
cd server
npm run start:prod
```

В production-режиме backend раздает собранный frontend из `frontend/dist`.

## Полезные команды

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

Backend:

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
npm run test:cov
npm run lint
```
