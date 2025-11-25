#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

            var password = po.GetOrCreateAttribute(nameof(Mock_Attribute.Password));
            password.DataType = "Password";

            var passwordReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.PasswordReadOnly));
            passwordReadOnly.DataType = "Password";
            passwordReadOnly.IsReadOnly = true;

            var passwordRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.PasswordRequired));
            passwordRequired.DataType = "Password";
            passwordRequired.AddRule("Required");
        })
    );

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
        {
            attribute = new Mock_Attribute
            {
                Id = objectId,
                Password = "S3cr3T",
                PasswordReadOnly = "S3cr3T",
                PasswordRequired = "S3cr3T"
            };
            attributes.Add(attribute);
        }

        return attribute;
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, object>(context)
{
    public override object? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public string? Password { get; set; }

    public string? PasswordReadOnly { get; set; }

    public string? PasswordRequired { get; set; }
}
