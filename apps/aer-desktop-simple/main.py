#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from ui.main_window import MainWindow
from config import Config

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Aer Capture")
    app.setApplicationVersion("1.0.0")
    
    # Set up dark mode on macOS
    app.setStyle('Fusion')
    
    # Create main window
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
