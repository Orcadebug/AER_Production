from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
    QPushButton, QCheckBox, QMessageBox
)
from PyQt6.QtCore import Qt
from config import Config

class SettingsDialog(QDialog):
    def __init__(self, parent, config: Config):
        super().__init__(parent)
        self.config = config
        self.init_ui()
        self.setWindowTitle("Aer Capture Settings")
        self.setGeometry(200, 200, 400, 300)
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # API Token
        layout.addWidget(QLabel("API Token:"))
        self.token_input = QLineEdit()
        self.token_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.token_input.setText(self.config.get('api_token', ''))
        self.token_input.setPlaceholderText("aer_xxxxxxx")
        layout.addWidget(self.token_input)
        
        # API URL
        layout.addWidget(QLabel("API URL:"))
        self.url_input = QLineEdit()
        self.url_input.setText(self.config.get('api_url', ''))
        self.url_input.setPlaceholderText("https://aercarbon.com")
        layout.addWidget(self.url_input)
        
        # Auto OCR
        self.auto_ocr_check = QCheckBox("Auto-extract text from screenshots (OCR)")
        self.auto_ocr_check.setChecked(self.config.get('auto_ocr', True))
        layout.addWidget(self.auto_ocr_check)
        
        layout.addStretch()
        
        # Buttons
        button_layout = QHBoxLayout()
        
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Save")
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #2563eb;
                color: white;
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #1d4ed8;
            }
        """)
        save_btn.clicked.connect(self.save_settings)
        button_layout.addWidget(save_btn)
        
        layout.addLayout(button_layout)
    
    def save_settings(self):
        token = self.token_input.text().strip()
        url = self.url_input.text().strip()
        
        if not token:
            QMessageBox.warning(self, "Validation Error", "API token cannot be empty")
            return
        
        if not url:
            QMessageBox.warning(self, "Validation Error", "API URL cannot be empty")
            return
        
        self.config.set('api_token', token)
        self.config.set('api_url', url)
        self.config.set('auto_ocr', self.auto_ocr_check.isChecked())
        
        QMessageBox.information(self, "Success", "Settings saved!")
        self.accept()
