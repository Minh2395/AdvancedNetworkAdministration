from django.http import JsonResponse
from django.utils import timezone


def api_status(request):
    return JsonResponse({
        "success": True,
        "message": "Network Dashboard Backend is running",
        "framework": "Django REST Framework",
        "network_automation": "Netmiko",
        "timestamp": timezone.now().isoformat(),
    })
