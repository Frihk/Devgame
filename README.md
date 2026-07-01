#  Reddit Monopoly Rush

A fast-paced, strategy-based board game inspired by the core mechanics of Monopoly, built for the **Reddit Games Hackathon 2026** using **Phaser**, **Go**, and **JavaScript**.

Unlike traditional Monopoly, this game focuses on quick matches, dynamic events, and strategic decision-making to create a fun experience players will want to replay.

---

##  Overview

Players compete to build the most valuable city by buying businesses, upgrading properties, completing challenges, and adapting to random events.

Each match is designed to be short, engaging, and highly replayable.

---

##  Features

- Dice-based movement
- Buy and upgrade businesses
- Earn income from owned properties
- Random event cards
- Fast-paced gameplay
- Leaderboards
- Sound effects and animations
- Custom game assets
- Responsive interface

---

## 🛠 Tech Stack

### Frontend

- JavaScript (ES6)
- Phaser 3
- HTML5
- CSS3
- Vite

### Backend

- Go
- SQLite
- REST API

### Tools

- Git & GitHub
- Figma
- VS Code

---

##  Project Structure

```
reddit-monopoly/
│
├── frontend/
│
├── backend/
│
├── assets/
│
├── docs/
│
├── shared/
│
├── README.md
│
└── docker-compose.yml
```

---

##  Frontend

```
frontend/
│
├── src/
│
├── public/
│
└── package.json
```

---

##  Backend

```
backend/
│
├── cmd/
├── internal/
├── database/
└── go.mod
```

---

##  Gameplay

1. Roll the dice.
2. Move around the board.
3. Buy available businesses.
4. Upgrade your businesses.
5. Collect income.
6. React to random events.
7. Build the highest-value city before the game ends.

---

##  Objective

Become the wealthiest player before the match timer expires by making smart investments and strategic decisions.

---

##  Team

| Name | Role |
|------|------|
| Emmaculate Akinyi and Ashley Omondi | Frontend |
| Sospeter Kinyanjui, Ian Kimani and Evans Juma | Backend |
| Member 3 | Game Logic |
| Ian Kimani | UI/UX |
| Member 5 | Assets & Testing |

---

##  Installation

### Clone the repository

```bash
git clone <repository-url>
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

### Backend

```bash
cd backend
go mod tidy
go run ./cmd/server
```

---

##  API

The backend exposes REST endpoints for:

- Authentication
- Game sessions
- Player data
- Leaderboards
- Saving game progress

---

##  Assets

Game assets are located in:

```
assets/
```

Including:

- Board
- Buildings
- Characters
- Dice
- Cards
- UI
- Icons
- Audio

---

##  Documentation

Additional documentation can be found in:

```
docs/
```

Including:

- Game Design
- Architecture
- API
- Database
- Roadmap
- Setup Guide

---

##  Git Workflow

Create a feature branch before starting work:

```bash
git checkout -b feature/your-feature
```

Commit changes:

```bash
git add .
git commit -m "feat: implement dice rolling"
```

Push:

```bash
git push origin feature/your-feature
```

---

## Project Status

Current Stage:

- [ ] Planning
- [ ] UI Design
- [ ] Board Implementation
- [ ] Player Movement
- [ ] Backend API
- [ ] Database
- [ ] Leaderboards
- [ ] Polish & Testing

---

## 📄 License

This project was created for the Reddit Games Hackathon 2026.
