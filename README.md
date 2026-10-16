# Olho na Caixa

Método para conferir tangerina e tomate na recepção de cozinhas escolares, com captura e cálculo no celular. O [enunciado do desafio](https://github.com/marx-correia/desafio-olho-na-caixa/tree/main) está no repositório de origem.

## Começar

Instale Node.js e execute `npm install` dentro de `app/`. Os comandos `make` rodam na **raiz do repositório**:

| Comando | Uso |
| :--- | :--- |
| `make dev` | App no computador: `http://localhost:3001`. |
| `make dev-wifi` | Android por depuração sem fio, com pareamento guiado. |
| `make dev-hotspot` | Alternativa por rede com USB inicial; depois pode tirar o cabo. |
| `make dev-usb` | Android mantendo o cabo USB conectado. |
| `make apk` | Gera APK instalável para testes. |
| `make docs-serve` | Livro em `http://localhost:3000`; precisa de mdBook. |

## Celular com atualização ao salvar

Instale Python 3 e [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools), com `adb` no PATH. No celular, habilite **Opções do desenvolvedor**.

**Wi-Fi normal (Android 11+):** conecte ambos à mesma rede, ative **Depuração sem fio → Parear dispositivo com código** e rode `make dev-wifi`. Informe IP:porta e código; mantenha a janela aberta até confirmar. Depois volte à tela **principal** da depuração e informe o IP:porta de conexão, diferente do pareamento. **Já pareou?** Use `make dev-wifi CONNECT=IP:PORTA` com esse endereço atual.

**Hotspot do celular:** conecte o notebook ao hotspot. Se a depuração sem fio continuar disponível, use **`make dev-wifi` sem cabo**, como acima. Se o Android exigir outra rede Wi-Fi para ativá-la, o pareamento anterior não basta: ative **Depuração USB**, conecte o cabo, aceite a autorização e rode **`make dev-hotspot`**. Informe o IP do celular (gateway/roteador nos detalhes da conexão do notebook) e tire o cabo após a confirmação. Reconecte com `make dev-hotspot PHONE_IP=IP`; após reiniciar o celular ou perder o modo TCP/IP, repita com USB. Esse modo também atende Android antigo em Wi-Fi comum. Ao terminar, desligue a depuração USB ou reinicie o celular.

**USB:** ative **Depuração USB**, conecte o cabo, aceite a autorização e rode `make dev-usb`.

Os comandos preparam a conexão e sobem o servidor ou reutilizam o da porta 3001. Abra **`http://localhost:3001` no Chrome do celular** e permita a câmera. Mantenha o servidor rodando; o app atualiza ao salvar. Se desconectar, repita o comando. HTTP pelo IP do notebook não libera a câmera.

## APK

Instale **JDK 21** e **Android SDK com Platform 35 e Build-Tools**. Configure `JAVA_HOME` e `ANDROID_HOME` e rode **`make apk`**.

O arquivo sai em **`app/android/app/build/outputs/apk/debug/app-debug.apk`**, assinado para testes. Transfira ao celular e autorize sua instalação. Funciona sem computador ou rede; alterações exigem gerar e instalar outro APK. A primeira compilação precisa de internet.

Recuperação de conexão, configuração alternativa do SDK/JDK e roteiro de teste: [Para o time](docs/olho-na-caixa/para-o-time.md). Mais comandos: `make help`.
