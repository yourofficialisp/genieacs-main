## Preview
<img width="1358" height="650" alt="GenieACS Dashboard" src="https://github.com/user-attachments/assets/d2689a26-9eed-4449-a0d3-2edffddd7bc6" />
<img width="1358" height="650" alt="GenieACS Interface" src="https://github.com/user-attachments/assets/c13ed312-d007-4cc2-987d-e82f171dd7ce" />
<img width="1358" height="650" alt="GenieACS Settings" src="https://github.com/user-attachments/assets/fdf7acae-cd32-404d-a50e-d77b59156ea5" />
<img width="1358" height="650" alt="GenieACS Management" src="https://github.com/user-attachments/assets/2d530df8-beb3-493e-ad04-8bafbc39ad3f" />
# genieacs-main
Automatic installer for GenieACS 

# Usage
```
apt install git curl -y
```
```
git clone https://github.com/yourofficialisp/genieacs-main
```
```
cd genieacs-main
```
```
chmod +x install.sh && chmod +x darkmode.sh
```
INSTALL GENIEACS DARKMODE Ubuntu OS 22.04
```
bash darkmode.sh
```
INSTALL GENIEACS THEMA ORIGINAL v@1.2.13
```
bash install.sh
```

Please read first !!!

#=== GenieACS Update Script ====#

Previous config will be deleted and replaced with new config

What will be updated:

   • Admin >> Preset <br>
   • Admin >> Provisions <br>
   • Admin >> Virtual Parameter<br>
   • Admin >> Config<br>
   
#===Those scripts/configs will be replaced with new ones ====#

If you have your own custom config/script,<br> 
please backup first, then after update do manual config again according to your custom config.<br>

GenieACS Access

Web UI: http://localhost:3000
Username: admin
Password: admin (virtualparameter menu etc are hidden)<br>
API: http://localhost:7557 <br>
CWMP (TR-069): http://your-server-ip:7547<br>

======= HOW TO RESTORE ========<br>
```
cd
```
```
sudo mongorestore --db=genieacs --drop genieacs-backup/genieacs
```

## 🤝 Contribution

Contributions are always welcome! Please create a pull request or report an issue if you find a bug.

## 📞 Contact & Support

- WhatsApp: +923036783333
- Telegram: https://t.me/yourofficialisp
- Email: your.official.isp@gmail.com

---

Managed by [NBB Wifiber](https://github.com/yourofficialisp)
