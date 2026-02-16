import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
const bcrypt = require('bcrypt');

// Carregar .env
config({ path: path.join(__dirname, '../../backend/.env') });

// Importar entities
import { Tenant } from '../../backend/src/database/entities/Tenant.entity';
import { Usuario, UserRole } from '../../backend/src/database/entities/Usuario.entity';
import { Produto } from '../../backend/src/database/entities/Produto.entity';
import { Categoria } from '../../backend/src/database/entities/Categoria.entity';
import { MovimentacaoEstoque } from '../../backend/src/database/entities/MovimentacaoEstoque.entity';
import { Pedido } from '../../backend/src/database/entities/Pedido.entity';
import { ItemPedido } from '../../backend/src/database/entities/ItemPedido.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_EMAIL = 'admin@loja.com';
const DEFAULT_PASSWORD = 'senha123';

async function seedUsuarioPadrao() {
  console.log('ðŸ‘¤ Criando usuÃ¡rio padrÃ£o...\n');

  // Criar DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, Usuario, Produto, Categoria, MovimentacaoEstoque, Pedido, ItemPedido],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('âœ… Conectado ao banco de dados\n');

    const manager = dataSource.manager;

    // Verificar se tenant existe
    let tenant = await manager.findOne(Tenant, {
      where: { id: TENANT_ID },
    });

    if (!tenant) {
      console.log('ðŸ“¦ Criando tenant...');
      tenant = manager.create(Tenant, {
        id: TENANT_ID,
        name: 'Loja Chocola Velha',
        domain: 'loja-chocola-velha',
        is_active: true,
      });
      await manager.save(tenant);
      console.log('âœ… Tenant criado\n');
    } else {
      console.log('âœ… Tenant jÃ¡ existe\n');
    }

    // Verificar se usuÃ¡rio jÃ¡ existe
    const existingUser = await manager.findOne(Usuario, {
      where: { email: DEFAULT_EMAIL },
    });

    if (existingUser) {
      console.log('âš ï¸  UsuÃ¡rio jÃ¡ existe. Atualizando senha...');
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      existingUser.encrypted_password = hashedPassword;
      existingUser.is_active = true;
      await manager.save(existingUser);
      console.log('âœ… Senha atualizada\n');
    } else {
      console.log('ðŸ‘¤ Criando usuÃ¡rio padrÃ£o...');
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

      const usuario = manager.create(Usuario, {
        tenant_id: TENANT_ID,
        email: DEFAULT_EMAIL,
        encrypted_password: hashedPassword,
        full_name: 'Administrador',
        role: UserRole.ADMIN,
        is_active: true,
      });

      await manager.save(usuario);
      console.log('âœ… UsuÃ¡rio criado\n');
    }

    console.log('ðŸ“‹ Credenciais padrÃ£o:');
    console.log(`   Email: ${DEFAULT_EMAIL}`);
    console.log(`   Senha: ${DEFAULT_PASSWORD}`);
    console.log('\nâœ… UsuÃ¡rio padrÃ£o configurado com sucesso!');
  } catch (error) {
    console.error('âŒ Erro ao criar usuÃ¡rio padrÃ£o:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedUsuarioPadrao();
