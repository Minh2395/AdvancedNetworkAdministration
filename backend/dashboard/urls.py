
from django.urls import path
from . import views

app_name = "dashboard"

urlpatterns = [
    path("api/status/", views.api_status, name="api_status"),
]
