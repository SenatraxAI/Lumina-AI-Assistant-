from app import app
import json
routes = []
for route in app.routes:
    routes.append({
        "path": getattr(route, "path", "N/A"),
        "methods": list(getattr(route, "methods", []))
    })
print(json.dumps(routes, indent=2))
