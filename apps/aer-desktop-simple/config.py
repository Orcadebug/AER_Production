import json
from pathlib import Path
from typing import Optional

class Config:
    def __init__(self):
        self.config_dir = Path.home() / '.aer-capture'
        self.config_dir.mkdir(exist_ok=True)
        self.config_file = self.config_dir / 'config.json'
        self.data = self._load()
    
    def _load(self) -> dict:
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except:
                return self._defaults()
        return self._defaults()
    
    def _defaults(self) -> dict:
        return {
            'api_token': '',
            'api_url': 'https://aercarbon.com',
            'auto_ocr': True,
            'auto_send': False,
        }
    
    def save(self):
        with open(self.config_file, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def get(self, key: str, default=None):
        return self.data.get(key, default)
    
    def set(self, key: str, value):
        self.data[key] = value
        self.save()
    
    @property
    def is_configured(self) -> bool:
        return bool(self.get('api_token'))
