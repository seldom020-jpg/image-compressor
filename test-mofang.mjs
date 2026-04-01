
import fs from 'fs';
import { handler as mofang_get_token } from './skills/mofang-records/dist/auth.js';

const config = {
  BASE_URL: 'http://60.2.40.164:999/magicflu',
  USERNAME: 'admin',
  PASSWORD: 'kdclxy@5970'
};

const result = await mofang_get_token({
  username: config.USERNAME,
  password: config.PASSWORD
}, { config });

if (result.success) {
  console.log('✅ 认证成功！');
  console.log('  用户昵称:', result.data.nickname);
  console.log('  用户名:', result.data.username);
  fs.writeFileSync('/tmp/mofang-connection.json', JSON.stringify({
    ...config,
    userId: result.data.id,
    nickname: result.data.nickname
  }));
  console.log('✅ 连接信息已保存');
} else {
  console.log('❌ 认证失败:', result.message);
}
