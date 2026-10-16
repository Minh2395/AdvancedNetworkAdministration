from django.db import models

# Create your models here.
class Device(models.Model):
    hostname = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField(unique=True)
    username = models.CharField(max_length=50)
    password = models.CharField(max_length=50)
    device_type = models.CharField(max_length=50, default='cisco_ios')
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.hostname} ({self.ip_address})"

class VLAN(models.Model):
    vlan_id = models.IntegerField()
    name = models.CharField(max_length=50)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='vlans')

    class Meta:
        unique_together = ('vlan_id', 'device')

    def __str__(self):
        return f"VLAN {self.vlan_id} - {self.name}"