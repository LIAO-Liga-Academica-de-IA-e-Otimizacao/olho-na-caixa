# Meshes da simulação

Estes arquivos alimentam o gerador de cenas. Eles não entram no aplicativo do celular e não vão para `app/public`.

Cada pasta recebe o mesh e as texturas que vierem com ele. Formatos aceitos: glTF (`.glb`, `.gltf`), FBX, OBJ, Blender (`.blend`) e USD. As texturas ficam ao lado do mesh, na mesma pasta.

Junto de cada mesh, deixe um arquivo `LICENSE` com o nome da licença e o endereço de onde o arquivo veio. CC0 pode entrar no repositório. Uma licença que proíbe redistribuir o arquivo solto fica só na máquina de render, e a pasta correspondente fica vazia aqui.

## tangerine

Uma fruta só, sem caixa. Esta é a malha que a cena repete, com escala e cor sorteadas.

## tomato

Um tomate só, sem caixa. Entra na cena do mesmo jeito que a tangerina.

## crates

Caixas vazias, do tipo usado em quitanda. Uma subpasta por caixa, com o nome do modelo. O vão interno, em centímetros, entra no `LICENSE` ou num `medidas.txt` ao lado: comprimento, largura e altura.

## filled-crate

Uma caixa já cheia de tangerinas, do jeito que foi publicada. Serve de referência visual. A cena não separa essas frutas para contar uma a uma, salvo se o arquivo trouxer cada fruta como um objeto distinto.
