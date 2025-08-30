import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from './schema';
import { DatabaseConfigType } from 'src/config/config.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private pool: Pool;
    public db: ReturnType<typeof drizzle<typeof schema>>;

    constructor(private configService: ConfigService) {}

    onModuleInit() {
        this.pool = new Pool({
            connectionString: this.configService.get<DatabaseConfigType>('database')!.url,
            max: 10,
            idleTimeoutMillis: 30000,
            ssl: true,
        });

        this.db = drizzle(this.pool, { schema, casing: 'camelCase' })
    }

    async onModuleDestroy() {
        await this.pool.end();
    }
}
