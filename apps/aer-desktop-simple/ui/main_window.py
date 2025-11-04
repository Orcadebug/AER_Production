from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QScrollArea, QMessageBox, QComboBox
)
from PyQt6.QtGui import QPixmap, QIcon
from PyQt6.QtCore import Qt, QSize, QThread, pyqtSignal
from pathlib import Path
import io
from PIL import Image, ImageDraw
from capture import capture_screen, extract_text
from api import upload_context
from config import Config
from .settings_dialog import SettingsDialog

class ScreenshotWorker(QThread):
    finished = pyqtSignal(object)  # PIL Image
    error = pyqtSignal(str)
    
    def run(self):
        try:
            img = capture_screen()
            self.finished.emit(img)
        except Exception as e:
            self.error.emit(str(e))

class OCRWorker(QThread):
    finished = pyqtSignal(str)  # extracted text
    error = pyqtSignal(str)
    
    def __init__(self, image: Image.Image):
        super().__init__()
        self.image = image
    
    def run(self):
        try:
            text = extract_text(self.image)
            self.finished.emit(text)
        except Exception as e:
            self.error.emit(str(e))

class UploadWorker(QThread):
    finished = pyqtSignal(str)  # response message
    error = pyqtSignal(str)
    
    def __init__(self, image: Image.Image, text: str, token: str, api_url: str, enc_key_b64: str):
        super().__init__()
        self.image = image
        self.text = text
        self.token = token
        self.api_url = api_url
        self.enc_key_b64 = enc_key_b64
    
    def run(self):
        try:
            result = upload_context(self.image, self.text, self.token, self.api_url, self.enc_key_b64)
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.config = Config()
        self.current_image = None
        self.current_text = None
        self.init_ui()
        self.setWindowTitle("Aer Capture")
        self.setGeometry(100, 100, 500, 600)
    
    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # Top bar with settings
        top_layout = QHBoxLayout()
        settings_btn = QPushButton("⚙️ Settings")
        settings_btn.clicked.connect(self.open_settings)
        top_layout.addStretch()
        top_layout.addWidget(settings_btn)
        layout.addLayout(top_layout)
        
        # Status
        self.status_label = QLabel("Ready to capture")
        self.status_label.setStyleSheet("color: #888; font-size: 12px;")
        layout.addWidget(self.status_label)
        
        # Screenshot button
        self.screenshot_btn = QPushButton("📸 Take Screenshot")
        self.screenshot_btn.setMinimumHeight(50)
        self.screenshot_btn.setStyleSheet("""
            QPushButton {
                font-size: 16px;
                font-weight: bold;
                padding: 12px;
                background-color: #2563eb;
                color: white;
                border: none;
                border-radius: 8px;
            }
            QPushButton:hover {
                background-color: #1d4ed8;
            }
            QPushButton:pressed {
                background-color: #1e40af;
            }
        """)
        self.screenshot_btn.clicked.connect(self.take_screenshot)
        layout.addWidget(self.screenshot_btn)
        
        # Preview area
        self.preview_label = QLabel()
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_label.setMinimumHeight(200)
        self.preview_label.setStyleSheet("""
            QLabel {
                background-color: #f3f4f6;
                border-radius: 8px;
                border: 2px dashed #d1d5db;
            }
        """)
        self.preview_label.setText("Screenshot preview will appear here")
        layout.addWidget(self.preview_label)
        
        # OCR text preview
        self.text_label = QLabel()
        self.text_label.setWordWrap(True)
        self.text_label.setStyleSheet("color: #666; font-size: 11px; padding: 8px;")
        layout.addWidget(QLabel("Extracted Text:"))
        
        scroll = QScrollArea()
        scroll.setWidget(self.text_label)
        scroll.setMinimumHeight(80)
        layout.addWidget(scroll)
        
        # Action buttons
        button_layout = QHBoxLayout()
        
        self.clear_btn = QPushButton("Clear")
        self.clear_btn.setMinimumHeight(40)
        self.clear_btn.setEnabled(False)
        self.clear_btn.clicked.connect(self.clear_screenshot)
        button_layout.addWidget(self.clear_btn)
        
        self.send_btn = QPushButton("✓ Send to Aer")
        self.send_btn.setMinimumHeight(40)
        self.send_btn.setEnabled(False)
        self.send_btn.setStyleSheet("""
            QPushButton {
                font-size: 14px;
                font-weight: bold;
                background-color: #10b981;
                color: white;
                border: none;
                border-radius: 8px;
            }
            QPushButton:hover:!disabled {
                background-color: #059669;
            }
            QPushButton:disabled {
                background-color: #d1d5db;
                color: #999;
            }
        """)
        self.send_btn.clicked.connect(self.send_screenshot)
        button_layout.addWidget(self.send_btn)
        
        layout.addLayout(button_layout)
        layout.addStretch()
    
    def take_screenshot(self):
        if not self.config.is_configured:
            QMessageBox.warning(self, "Not Configured", 
                              "Please configure your API token in Settings first.")
            self.open_settings()
            return
        
        self.status_label.setText("Taking screenshot...")
        self.screenshot_btn.setEnabled(False)
        
        self.screenshot_worker = ScreenshotWorker()
        self.screenshot_worker.finished.connect(self.on_screenshot_taken)
        self.screenshot_worker.error.connect(self.on_screenshot_error)
        self.screenshot_worker.start()
    
    def on_screenshot_taken(self, image: Image.Image):
        self.current_image = image
        
        # Show preview
        pixmap = QPixmap()
        buffer = io.BytesIO()
        image.thumbnail((300, 300), Image.Resampling.LANCZOS)
        image.save(buffer, format='PNG')
        pixmap.loadFromData(buffer.getvalue())
        self.preview_label.setPixmap(pixmap)
        
        # Extract text if auto_ocr enabled
        if self.config.get('auto_ocr'):
            self.status_label.setText("Extracting text...")
            self.ocr_worker = OCRWorker(self.current_image)
            self.ocr_worker.finished.connect(self.on_text_extracted)
            self.ocr_worker.error.connect(self.on_ocr_error)
            self.ocr_worker.start()
        else:
            self.status_label.setText("Screenshot ready - click Send to upload")
            self.screenshot_btn.setEnabled(True)
            self.clear_btn.setEnabled(True)
            self.send_btn.setEnabled(True)
    
    def on_screenshot_error(self, error: str):
        self.status_label.setText(f"Error: {error}")
        self.screenshot_btn.setEnabled(True)
        QMessageBox.critical(self, "Screenshot Failed", error)
    
    def on_text_extracted(self, text: str):
        self.current_text = text
        preview = text[:200] + "..." if len(text) > 200 else text
        self.text_label.setText(preview if preview.strip() else "(No text detected)")
        self.status_label.setText("Ready to send")
        self.screenshot_btn.setEnabled(True)
        self.clear_btn.setEnabled(True)
        self.send_btn.setEnabled(True)
    
    def on_ocr_error(self, error: str):
        self.status_label.setText(f"OCR failed: {error}")
        self.screenshot_btn.setEnabled(True)
        self.clear_btn.setEnabled(True)
        self.send_btn.setEnabled(True)
    
    def send_screenshot(self):
        if not self.current_image:
            return
        
        self.send_btn.setEnabled(False)
        self.status_label.setText("Uploading...")
        
        token = self.config.get('api_token')
        api_url = self.config.get('api_url')
        enc_key = self.config.get('encryption_key')
        if not enc_key:
            QMessageBox.warning(self, "Missing Encryption Key", "Please set an encryption key in Settings.")
            self.open_settings()
            self.send_btn.setEnabled(True)
            return
        
        self.upload_worker = UploadWorker(
            self.current_image,
            self.current_text or "",
            token,
            api_url,
            enc_key
        )
        self.upload_worker.finished.connect(self.on_upload_success)
        self.upload_worker.error.connect(self.on_upload_error)
        self.upload_worker.start()
    
    def on_upload_success(self, message: str):
        self.status_label.setText("✓ Uploaded successfully!")
        QMessageBox.information(self, "Success", "Screenshot uploaded to Aer!")
        self.clear_screenshot()
    
    def on_upload_error(self, error: str):
        self.status_label.setText(f"Upload failed: {error}")
        self.send_btn.setEnabled(True)
        QMessageBox.critical(self, "Upload Failed", error)
    
    def clear_screenshot(self):
        self.current_image = None
        self.current_text = None
        self.preview_label.setText("Screenshot preview will appear here")
        self.preview_label.setPixmap(QPixmap())
        self.text_label.setText("")
        self.screenshot_btn.setEnabled(True)
        self.clear_btn.setEnabled(False)
        self.send_btn.setEnabled(False)
        self.status_label.setText("Ready to capture")
    
    def open_settings(self):
        dialog = SettingsDialog(self, self.config)
        dialog.exec()
