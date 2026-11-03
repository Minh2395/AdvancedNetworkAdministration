from django.urls import path
from . import views

app_name = "dashboard"

urlpatterns = [
    path("api/status/", views.api_status, name="api_status"),
    path("api/stats/", views.get_stats, name="api_stats"),
    path("api/devices/", views.devices_api, name="api_devices"),
    path("api/devices/<int:pk>/delete/", views.delete_device_api, name="api_delete_device"),
    path("api/devices/<int:pk>/toggle/", views.toggle_device_api, name="api_toggle_device"),
    path("api/devices/<int:pk>/check/", views.check_device_api, name="api_check_device"),
    path("api/vlans/", views.vlans_api, name="api_vlans"),
    path("api/vlans/create/", views.create_vlan_api, name="api_create_vlan"),
    path("api/vlans/<int:pk>/delete/", views.delete_vlan_api, name="api_delete_vlan"),
    path("api/ports/assign/", views.assign_port_api, name="api_assign_port"),
    path("api/ports/<int:pk>/delete/", views.delete_port_api, name="api_delete_port"),
    path("api/topology/", views.topology_api, name="api_topology"),
]