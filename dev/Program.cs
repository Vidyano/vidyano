using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading;

using Raven.Client.Documents;
using Raven.Client.Exceptions;
using Raven.Client.Exceptions.Cluster;
using Raven.Client.ServerWide.Operations;

namespace Dev
{
    public class Program
    {
        public static IHostEnvironment HostEnvironment { get; private set; }

        private static readonly string[] DefaultRavenDbUrls = { "http://localhost:8081" };
        private const int RavenDbServerTcpCheckPort = 8081;
        private const string RavenDbStartScriptPath = "/usr/local/bin/start-ravendb.sh";
        private const int MaxConnectionRetries = 12; // 12 * 5s = 1 minute total wait time
        private const int RetryDelayMilliseconds = 5000; // 5 seconds between retries

        public static void Main(string[] args)
        {
            EnsureRavenDbRunning();
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureAppConfiguration((hostingContext, config) =>
                {
                    var env = HostEnvironment = hostingContext.HostingEnvironment;

                    config.AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
                        .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true, reloadOnChange: false);

                    config.AddEnvironmentVariables();

                    if (env.IsDevelopment())
                        config.AddUserSecrets<Program>();
                })
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });
                
        private static void EnsureRavenDbRunning()
        {
            if (!IsRavenDbTcpPortListening())
            {
                Console.WriteLine($"RavenDB TCP port ({RavenDbServerTcpCheckPort}) not responding. Attempting to start RavenDB via script: {RavenDbStartScriptPath}");
                try
                {
                    Process.Start(new ProcessStartInfo(RavenDbStartScriptPath)
                    {
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    });

                    Console.WriteLine($"RavenDB start command issued. Waiting {RetryDelayMilliseconds}ms for initial startup...");
                    Thread.Sleep(RetryDelayMilliseconds);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to start RavenDB process: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine($"RavenDB TCP port ({RavenDbServerTcpCheckPort}) is already listening.");
            }

            Console.WriteLine($"Attempting to connect to RavenDB at {string.Join(", ", DefaultRavenDbUrls)} and verify responsiveness...");
            
            for (int i = 0; i < MaxConnectionRetries; i++)
            {
                IDocumentStore tempStore = null;
                try
                {
                    tempStore = new DocumentStore
                    {
                        Urls = DefaultRavenDbUrls,
                    }.Initialize();

                    tempStore.Maintenance.Server.Send(new GetBuildNumberOperation());
                    
                    Console.WriteLine("RavenDB server is up and fully responsive.");
                    return;
                }
                catch (NodeIsPassiveException ex)
                {
                    Console.WriteLine($"RavenDB node is passive. Retrying in {RetryDelayMilliseconds / 1000}s... (Attempt {i + 1}/{MaxConnectionRetries}). Details: {ex.Message}");
                }
                catch (AllTopologyNodesDownException ex)
                {
                     Console.WriteLine($"RavenDB topology nodes are down/unreachable. Retrying in {RetryDelayMilliseconds / 1000}s... (Attempt {i + 1}/{MaxConnectionRetries}). Details: {ex.Message}");
                }
                catch (SocketException ex)
                {
                    Console.WriteLine($"Network error connecting to RavenDB HTTP endpoint. Retrying in {RetryDelayMilliseconds / 1000}s... (Attempt {i + 1}/{MaxConnectionRetries}). Details: {ex.Message}");
                }
                catch (RavenException ex)
                {
                    Console.WriteLine($"RavenDB client error. Retrying in {RetryDelayMilliseconds / 1000}s... (Attempt {i + 1}/{MaxConnectionRetries}). Error: {ex.GetType().Name} - {ex.Message}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"An unexpected error occurred while checking RavenDB responsiveness. Retrying in {RetryDelayMilliseconds / 1000}s... (Attempt {i + 1}/{MaxConnectionRetries}). Error: {ex.GetType().Name} - {ex.Message}");
                }
                finally
                {
                    tempStore?.Dispose();
                }

                if (i < MaxConnectionRetries - 1)
                {
                    Thread.Sleep(RetryDelayMilliseconds);
                }
            }

            throw new TimeoutException($"RavenDB server at {string.Join(", ", DefaultRavenDbUrls)} did not become responsive after {MaxConnectionRetries} retries ({MaxConnectionRetries * RetryDelayMilliseconds / 1000} seconds). Please check RavenDB logs.");
        }

        private static bool IsRavenDbTcpPortListening()
        {
            try
            {
                using var client = new TcpClient();
                var task = client.ConnectAsync("localhost", RavenDbServerTcpCheckPort);

                if (task.Wait(TimeSpan.FromMilliseconds(500))) 
                    return client.Connected;

                return false;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}