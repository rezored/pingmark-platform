module.exports = {
	apps: [
		{
			name: "pingmark-api",
			script: "apps/api/dist/src/server.js",
			env: { NODE_ENV: "production", PORT: 5175, LOG_LEVEL: "info" },
			instances: 2,
			exec_mode: "cluster",
			max_memory_restart: "200M",
			out_file: "/var/log/pm2/pingmark-api.out.log",
			error_file: "/var/log/pm2/pingmark-api.err.log",
			log_date_format: "YYYY-MM-DD HH:mm:ss"
		}
	]
};