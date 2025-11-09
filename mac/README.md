# Aer Mac (Electron) quick notes

- Requires macOS Screen Recording permission on first capture.
- Premium now calls your Aer credits endpoint (`/api/premium/analyze`) instead of OpenAI directly.
- RobotJS is optional; not required for basic flows.

## Premium endpoint contract (expected)
POST {BASE_URL}/api/premium/analyze
Headers:
- Authorization: Bearer aer_{userId}
- Content-Type: application/json
Body:
```json
{"image":"data:image/png;base64,...."}
```
Responses:
- 200 OK:
```json
{"insights": {"summary":"...","entities":["..."],"confidence":0.92}}
```
- 402/403/429 Credits exhausted or unavailable:
```json
{"error":"CREDITS_EXHAUSTED"}
```
- Other failures: 4xx/5xx with message.

The app will show: "Credits exhausted. Use Basic or top up in your account." when it detects depletion.
