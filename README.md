# Mini Mundo 2D 
Pequeno experimento de jogo 2D Isométrico escrito em JavaScript puro e empacotado com Parcel. Inclui manejo pessoal, comercial e industrial de inventário, crafting com receitas, profissões e árvores de conhecimento com xp, combate PvP e PvE, simulação de pecuária, caça, manejo do solo e preservação de biomas. Sistemas Políticos e Sociais complexos; sistema de reputação, urnas eleitorais, territórios, contratos e livre associação entre jogadores. Economia movida por players; mercado privado, instituições financeiras, empreendedorismo, emprego, linhas de produção, setor imobiliário, moeda, inflação. Transporte urbano e indústria mobilística, trens, metrôs, aviões, biciletas, ambulâncias, skates e taxis. Cultura e personalização, criação de personagem diversa e inclusiva, customização de vestimentas, arte, música e escrita. Combate em tempo real com armas realistas e magia baseada em karma, sorte e intuição. Ciclo de vida e reencarnação, você só tem uma vida.
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
- **Shift**: Sprint
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
