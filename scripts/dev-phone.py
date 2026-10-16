"""Connect an Android phone, forward localhost, and start the Next dev server."""

import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent


def fail(message):
    raise SystemExit(message)


def adb(*args, capture=False):
    return subprocess.run(
        ["adb", *args], check=True, text=True,
        stdout=subprocess.PIPE if capture else None,
    ).stdout


def ask(message):
    if not sys.stdin.isatty():
        fail("Este passo pede entrada no terminal. Veja PAIR, CONNECT e PHONE_IP no README.")
    return input(message).strip()


def devices(usb_only=False):
    result = []
    for line in adb("devices", "-l", capture=True).splitlines()[1:]:
        fields = line.split()
        if len(fields) < 2 or fields[1] != "device":
            continue
        if not usb_only or any(field.startswith("usb:") for field in fields[2:]):
            result.append(fields[0])
    return result


def usb_device():
    available = devices(usb_only=True)
    requested = os.environ.get("DEVICE")
    if requested:
        if requested not in available:
            fail("DEVICE não é um aparelho USB autorizado. Confira adb devices -l e aceite a chave no celular.")
        return requested
    if len(available) != 1:
        fail("Conecte um único Android por USB, ative depuração USB e aceite a chave. "
             "Com vários aparelhos, use DEVICE=serial (adb devices -l).")
    return available[0]


def endpoint(value):
    # Accept IPv4/host:port and bracketed IPv6:port, never ADB flags.
    host, separator, port = value.rpartition(":")
    if (not separator or not host or host.startswith("-")
            or any(char.isspace() for char in value)
            or not port.isdigit() or not 1 <= int(port) <= 65535):
        fail("Endereço inválido. Use IP:PORTA, como mostrado no celular.")
    return value


def connect(address, attempts=1):
    address = endpoint(address)
    for attempt in range(attempts):
        try:
            adb("connect", address)
            # adb connect can return exit code 0 even when the connection failed.
            if adb("-s", address, "get-state", capture=True).strip() == "device":
                return address
        except subprocess.CalledProcessError:
            pass
        if attempt + 1 < attempts:
            time.sleep(1)
    fail("A conexão não ficou pronta. Confira o IP, a porta e a autorização no celular.")


def pair_phone(address):
    while True:
        print("Mantenha a janela Parear com código aberta no celular até o ADB confirmar.")
        try:
            adb("pair", endpoint(address))
            return
        except subprocess.CalledProcessError:
            print("O pareamento falhou; 'Success' no final de um erro de protocolo não confirma sucesso.")
            print("Feche e reabra Parear com código no celular. Use a NOVA porta e o NOVO código.")
            print("Confira se os dois aparelhos estão na mesma rede e mantenha essa janela aberta.")
            if not sys.stdin.isatty():
                fail("Rode make dev-wifi novamente com o novo PAIR. Veja a recuperação em Para o time.")
            address = ask("Novo IP:porta de PAREAMENTO (Enter para encerrar): ")
            if not address:
                fail("Pareamento não concluído. Veja a recuperação em Para o time.")


def wifi():
    pair = os.environ.get("PAIR", "")
    address = os.environ.get("CONNECT", "")
    requested = os.environ.get("DEVICE", "")
    available = devices()
    usb = devices(usb_only=True)
    if requested and not pair and not address:
        if requested not in available:
            fail("DEVICE não está conectado. Confira adb devices -l.")
        if requested in usb or requested.startswith("emulator-"):
            fail("DEVICE deve ser uma conexão sem fio. Use make dev-usb para USB.")
        return requested
    if not pair and not address:
        wireless = [device for device in available
                    if device not in usb and not device.startswith("emulator-")]
        if len(wireless) == 1:
            return wireless[0]
        print("Na mesma rede Wi-Fi, ative Opções do desenvolvedor > Depuração sem fio.")
        print("Abra Parear com código. A porta de pareamento difere da porta de conexão.")
        pair = ask("IP:porta de PAREAMENTO (Enter se já pareado): ")
    if pair:
        pair_phone(pair)
        print("Pareamento concluído. Agora falta conectar ao aparelho para abrir o app.")
    if not address:
        print("No celular, volte à tela PRINCIPAL de Depuração sem fio.")
        print("Copie o campo Endereço IP e porta dessa tela; não use a porta de pareamento.")
        print("O comando vai conectar, encaminhar a porta e iniciar o servidor.")
        address = ask("IP:porta de CONEXÃO, na tela principal de Depuração sem fio: ")
    return connect(address)


def hotspot():
    print("Conecte o notebook ao hotspot do celular. Ative depuração USB e autorize este computador.")
    phone_ip = os.environ.get("PHONE_IP", "")
    # Allow reconnection without USB once TCP/IP mode has been enabled.
    if devices(usb_only=True):
        serial = usb_device()
        adb("-s", serial, "tcpip", "5555")
    else:
        print("Sem USB: tentando reconectar. Se falhar, conecte o cabo e rode novamente.")
    if not phone_ip:
        print("O IP do celular é o gateway/roteador da conexão Wi-Fi nas configurações do notebook.")
        phone_ip = ask("IP do celular no hotspot (sem porta): ")
    # adbd restarts when switching to TCP/IP, so the first connection may race it.
    serial = connect(f"{phone_ip}:5555", attempts=5)
    print("Conexão pelo hotspot pronta: pode tirar o cabo USB.")
    return serial


def main():
    if not shutil.which("adb"):
        fail("Instale Android SDK Platform-Tools e coloque adb no PATH.")
    if not shutil.which("npm") or not (ROOT / "app/node_modules").is_dir():
        fail("Instale Node.js e execute: cd app && npm install")
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode not in ("usb", "wifi", "hotspot"):
        fail("Uso: dev-phone.py usb|wifi|hotspot")
    serial = {"usb": usb_device, "wifi": wifi, "hotspot": hotspot}[mode]()
    adb("-s", serial, "reverse", "tcp:3001", "tcp:3001")
    print("No Chrome do celular, abra http://localhost:3001 e permita a câmera.")
    print("Mudanças no código web aparecem ao salvar. Se a conexão cair, repita o comando make.")
    with socket.socket() as probe:
        probe.settimeout(1)
        if probe.connect_ex(("127.0.0.1", 3001)) == 0:
            print("A porta 3001 já está em uso: usando o servidor existente. Confira se é o app.")
            return
    os.chdir(ROOT / "app")
    sys.stdout.flush()
    os.execvp("npm", ["npm", "run", "dev"])


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        fail("Operação cancelada.")
    except subprocess.CalledProcessError as error:
        fail(f"Falha no comando {error.cmd[0]}. Confira a mensagem acima e rode novamente.")
