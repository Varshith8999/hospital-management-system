"""Open the Hospital Management System login page in the default browser.

Usage:
    python open_login.py
"""

import webbrowser

LOGIN_URL = "http://localhost:5173/login"

if __name__ == "__main__":
    print(f"Opening {LOGIN_URL} ...")
    webbrowser.open(LOGIN_URL)
