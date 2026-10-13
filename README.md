# Advanced Network Administration

A simple web-based network administration dashboard built with Django REST Framework, Netmiko, HTML, CSS, and JavaScript.

The project aims to provide a centralized web interface for monitoring network devices and performing network administration tasks through automation.

## Features

- **Web Dashboard:** A simple and responsive interface for network administration.
- **Backend API:** Django REST Framework provides endpoints for frontend communication.
- **System Status:** Check whether the backend API is available.
- **Network Automation:** Netmiko integration planned for connecting to network devices and executing commands.
- **Modular Structure:** Frontend and backend are organized into separate directories.

> **Current status:** The frontend is connected to the Django backend through the `/api/status/` endpoint. Real network device integration is still under development.

## Technology Stack

### Backend

- Python
- Django
- Django REST Framework
- Netmiko

### Frontend

- HTML5
- CSS3
- JavaScript
- Bootstrap

## Project Structure

```text
AdvancedNetworkAdministration/
├── .gitignore
├── README.md
├── backend/
│   ├── config/
│   ├── dashboard/
│   │   ├── services/
│   │   ├── urls.py
│   │   └── views.py
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

The backend virtual environment (`.venv/`) is created locally and excluded from Git.

## Prerequisites

- Python 3.9 or later
- pip
- A modern web browser
- Git

## Installation and Setup

### 1. Clone the repository

```bash
git clone <https://github.com/Minh2395/AdvancedNetworkAdministration>
cd AdvancedNetworkAdministration
```

Replace `<YOUR_GITHUB_REPOSITORY_URL>` with your actual repository URL.

### 2. Set up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

If `requirements.txt` does not yet contain `django-cors-headers`, install it:

```bash
pip install django-cors-headers
```

### 3. Start the backend server

From the `backend/` directory, run:

```bash
python manage.py runserver 127.0.0.1:8000
```

The backend API will be available at:

```text
http://127.0.0.1:8000/api/status/
```

### 4. Start the frontend

Open a second terminal and run:

```bash
cd ~/Documents/projects/AdvancedNetworkAdministration/frontend
python3 -m http.server 5500 --bind 127.0.0.1
```

Open the dashboard in your browser:

```text
http://127.0.0.1:5500
```

Keep both servers running while using the dashboard.

## API Endpoint

### Check Backend Status

```http
GET /api/status/
```

Example response:

```json
{
  "success": true,
  "message": "Network Dashboard Backend is running",
  "framework": "Django REST Framework",
  "network_automation": "Netmiko",
  "timestamp": "2026-10-13T00:04:10.932723+00:00"
}
```

The `network_automation` field identifies the intended automation library; it does not indicate that a router or switch is currently connected.

## Development Roadmap

- [x] Create the Django backend.
- [x] Create the initial frontend dashboard.
- [x] Implement the backend status API.
- [x] Connect the frontend to the backend.
- [x] Configure CORS for local development.
- [ ] Add network device management.
- [ ] Integrate Netmiko with routers and switches.
- [ ] Display device connectivity and interface status.
- [ ] Execute authorized network commands through the dashboard.
- [ ] Add authentication and access control.

## Security Notes

- Do not commit passwords, private keys, API tokens, or `.env` files.
- Use authorized credentials when connecting to network devices.
- Restrict access to network administration features.
- Django's development server is intended for development, not production deployment.

## Author

**Võ Ngô Minh, Phan Nguyễn Gia Huy, Lê Hoàng Hữu Lộc**

## License

This project is developed for educational purposes.
