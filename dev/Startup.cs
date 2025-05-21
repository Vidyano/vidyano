using System;
using System.IO;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Raven.Client.Documents;
using Raven.Client.Documents.Indexes;
using Raven.Client.Documents.Operations;
using Raven.Client.Documents.Operations.Backups;
using Raven.Client.Exceptions;
using Raven.Client.Exceptions.Database;
using Raven.Client.ServerWide.Operations;
using Vidyano.Service;
using Vidyano.Service.RavenDB;
using Dev.Service;

namespace Dev
{
    public class Startup
    {
        public Startup(IConfiguration configuration, IWebHostEnvironment environment)
        {
            Configuration = configuration;
            Environment = environment;
        }

        public IConfiguration Configuration { get; }

        public IWebHostEnvironment Environment { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddVidyanoRavenDB(Configuration, options =>
            {
                var settings = new DatabaseSettings();
                Configuration.Bind("Database", settings);
                if (settings.CertPath != null)
                    settings.CertPath = Path.Combine(Environment.ContentRootPath, settings.CertPath);

                EnsureDatabaseExists(settings);

                var store = settings.CreateStore();
                options.Store = store;

                options.OnInitialized = () => IndexCreation.CreateIndexes(typeof(Startup).Assembly, store);
            });
            services.AddScoped<DevContext>();
            services.AddTransient<RequestScopeProvider<DevContext>>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app)
        {
            if (Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseCors(builder =>
            {
                builder
                .AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader();
            });
        
            app.UseStaticFiles();

            app.UseVidyano(Environment, Configuration, cors => cors.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
        }

        private static void EnsureDatabaseExists(DatabaseSettings settings)
        {
            using IDocumentStore store = settings.CreateStore();

            if (string.IsNullOrWhiteSpace(store.Database))
                throw new InvalidOperationException("Store needs a default Database to enable EnsureDatabaseExists.");

            try
            {
                store.Initialize();
                store.Maintenance.ForDatabase(store.Database).Send(new GetStatisticsOperation());
            }
            catch (DatabaseDoesNotExistException)
            {
                try
                {
                    Console.Write("Restoring database...");

                    var config = new RestoreBackupConfiguration()
                    {
                        BackupLocation = Path.Combine(Program.HostEnvironment.ContentRootPath, "App_Data/Database"),
                        DatabaseName = "Dev"
                    };

                    var restoreOperation = new RestoreBackupOperation(config);
                    store.Maintenance.Server.Send(restoreOperation).WaitForCompletion();

                    Console.WriteLine("Done");
                }
                catch (ConcurrencyException)
                {
                    // The database was already created before calling CreateDatabaseOperation
                }
            }
        }
    }
}