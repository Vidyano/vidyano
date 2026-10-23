using Dev.Service.Supervisor;

Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((hostingContext, config) =>
    {
        var env = hostingContext.HostingEnvironment;

        config.AddJsonFile("appsettings.json", true, false)
            .AddJsonFile($"appsettings.{env.EnvironmentName}.json", true, false)
            .AddJsonFile("secrets/appsettings.secrets.json", true, false);

        config.AddEnvironmentVariables();

        if (env.IsDevelopment())
            config.AddUserSecrets<Program>();
    })
    .ConfigureLogging((context, logging) =>
    {
        if (context.HostingEnvironment.IsDevelopment())
            logging.AddProvider(new SupervisorLoggerProvider());
    })
    .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<Dev.Startup>(); })
    .Build().Run();