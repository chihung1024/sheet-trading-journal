from pathlib import Path

import yaml


def test_staging_deploy_workflow_is_valid_yaml_and_protected():
    workflow_path = Path('.github/workflows/deploy-worker-staging.yml')
    workflow = yaml.load(workflow_path.read_text(encoding='utf-8'), Loader=yaml.BaseLoader)

    assert isinstance(workflow, dict)
    assert 'on' in workflow
    dispatch = workflow['on']['workflow_dispatch']
    assert set(dispatch['inputs']) == {'source_sha', 'confirm_environment'}

    job = workflow['jobs']['deploy-staging']
    assert job['environment'] == 'staging'
    assert job['timeout-minutes'] == '30'
    assert workflow['permissions'] == {'contents': 'read'}
    assert workflow['concurrency']['cancel-in-progress'] == 'false'

    steps = {step['name']: step for step in job['steps']}
    checkout = steps['Checkout exact requested commit']
    assert checkout['with']['persist-credentials'] == 'false'
    assert checkout['with']['fetch-depth'] == '0'

    verify = steps['Verify staging confirmation and exact main-reachable source']
    assert verify['id'] == 'source'
    assert 'git merge-base --is-ancestor' in verify['run']

    render = steps['Render isolated staging Wrangler config']
    assert set(render['env']) == {
        'CLOUDFLARE_D1_DATABASE_ID',
        'CLOUDFLARE_D1_DATABASE_NAME',
        'STAGING_GOOGLE_CLIENT_ID',
        'SOURCE_COMMIT',
    }

    inventory = steps['Verify pre-provisioned staging secret inventory']
    assert 'wrangler secret list' in inventory['run']
    assert 'verify_staging_secret_inventory.mjs' in inventory['run']

    deploy = steps['Deploy exact staging Worker source']
    assert '.wrangler/staging.toml' in deploy['run']
    assert '--experimental-provision=false' in deploy['run']
    assert '--experimental-auto-create=false' in deploy['run']
