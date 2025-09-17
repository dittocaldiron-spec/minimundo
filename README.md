# Mini Mundo 2D

Pequeno experimento de jogo top‑down escrito em JavaScript puro e empacotado com Parcel.
Inclui um sistema básico de inventário, crafting com receitas, coleta automática de itens,
interações com árvores, rochas, vacas, fogueiras e baús persistentes.

## Como executar

```bash
npm install
npm run start
```

O servidor do Parcel abrirá a página em `http://localhost:1234`.

Para gerar uma build estática:

```bash
npm run build
```

## Controles

- **WASD**: mover o personagem.
- **Mouse esquerdo**: interagir (coletar, quebrar árvore/rocha, atacar).
- **Mouse direito**: abrir baú ou posicionar item equipado.
- **E**: abrir/fechar inventário (também fecha baús).
- **C**: abrir/fechar carteira.
- **Q**: soltar 1 unidade do item equipado.
- **Alt + clique em slot**: soltar item diretamente do inventário.
- **Esc**: fechar janelas abertas.

## Destaques

- Inventário e carteira com pilhas automáticas e suporte a itens com metadados
  (baús carregam seus próprios conteúdos).
- Crafting funcional com lista de receitas filtrada dinamicamente e rollback automático
  se não houver espaço no inventário para o resultado.
- Coleta automática de moedas e drops próximos ao jogador e realce do alvo mais próximo
  na cena para facilitar interações.
- Baús persistem os itens guardados, impedem recursividade (baú dentro de baú) e
  permitem mover pilhas parcialmente conforme o espaço disponível.
