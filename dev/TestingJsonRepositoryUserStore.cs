using System.Reflection;
using Vidyano.Core.Services;
using Vidyano.Service.Repository.DataLayer;

namespace Dev;

public class TestingJsonRepositoryUserStore : JsonRepositoryUserStore
{
    public override void PersistChanges()
    {
        // No-op for testing purposes
    }

    public static void Reset()
    {
        // No-op for testing purposes.
 
        var userStore = ServiceLocator.GetService<IRepositoryUserStore>();
 
        typeof(JsonRepositoryUserStore).GetField("cache", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(userStore, null);
    }
}