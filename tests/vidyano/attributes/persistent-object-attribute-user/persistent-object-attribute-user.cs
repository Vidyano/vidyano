#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*
#:package Bogus@35.*

using Bogus;
using System.ComponentModel.DataAnnotations;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

Randomizer.Seed = new Random(8675309); // Deterministic seed for consistent bogus data

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano =>
{
    vidyano
        .WithUrls("http://localhost:44355")
        .WithDefaultAdmin()
        .WithDefaultUser("Admin")
        .WithSchemaRights()
        .WithMenuItem(nameof(MockContext.Attributes))
        .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

            var userReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.UserReadOnly));
            userReadOnly.IsReadOnly = true;
        });

    var faker = new Faker();
    for (var i = 0; i < 10; i++)
    {
        vidyano.WithUser(
            faker.Internet.UserName(),
            faker.Internet.Password(memorable: true),
            faker.Random.ArrayElements(["Administrators", "Users"], faker.Random.Int(1, 2))
        );
    }
});

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    private static readonly Guid DefaultUserId = Manager.Current.GetUser("admin")!.Id;

    public string Id { get; set; } = null!;

    [DataType(DataTypes.User)]
    public Guid User { get; set; } = DefaultUserId;

    [DataType(DataTypes.User)]
    public Guid UserReadOnly { get; set; } = DefaultUserId;

    [DataType(DataTypes.NullableUser)]
    public Guid? NullableUser { get; set; } = null;
}